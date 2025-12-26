'use client';

import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { startProgress } from '@/lib/nprogress';
import { Map as MapGL, Marker, Source, Layer, MapRef } from 'react-map-gl/maplibre';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { PNode } from '@/lib/types/pnode';
import { ZoomIn, ZoomOut, RotateCcw, Globe, ChevronLeft, ChevronRight, MapPin, Info } from 'lucide-react';
import { getFlagForCountry } from '@/lib/utils/country-flags';

interface MapLibreGlobeProps {
  nodes: PNode[];
  centerLocation?: { lat: number; lon: number }; // Optional location to center on (scan location)
  scanLocation?: { lat: number; lon: number; city?: string; country?: string }; // Scan location to show marker and connections
  scanTopNodes?: PNode[]; // Top nodes to connect to scan location (top 20)
  navigateToNodeId?: string | null; // Node ID to navigate to (from search)
  onNodeClick?: (node: PNode) => void; // Callback when a node is clicked (should navigate to node)
  onPopupClick?: (node: PNode) => void; // Callback when popup is clicked (should open node details modal)
  autoRotate?: boolean; // Whether to enable auto-rotation (default: true)
}


const statusColors = {
  online: '#3F8277', // Xandeum green
  syncing: '#F0A741', // Xandeum orange
  offline: '#FF4444', // Red
};

// High-quality dark globe style with retina tiles
const MAP_STYLE = {
  version: 8,
  sources: {
    'carto-dark': {
      type: 'raster',
      tiles: [
        'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
        'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
        'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png'
      ],
      tileSize: 512,
      attribution: '© OpenStreetMap contributors, © CARTO',
      maxzoom: 20,
    },
  },
  layers: [
    {
      id: 'globe-background',
      type: 'background',
      paint: {
        'background-color': '#3a4a63', // Visibly lighter base
      },
    },
    {
      id: 'carto-dark-layer',
      type: 'raster',
      source: 'carto-dark',
      minzoom: 0,
      maxzoom: 20,
      paint: {
        'raster-opacity': 0.9,
        'raster-brightness-min': 0.6, // Very aggressive brightening
        'raster-brightness-max': 1.0,
        'raster-contrast': 0.1,
      },
    },
  ],
  glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
} as const;

function MapLibreGlobe({ nodes, centerLocation, scanLocation, scanTopNodes, navigateToNodeId, onNodeClick, onPopupClick, autoRotate = true }: MapLibreGlobeProps) {
  const router = useRouter();
  const mapRef = useRef<MapRef>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [currentNodeIndex, setCurrentNodeIndex] = useState(-1); // -1 = no node selected initially
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [activeScanConnector, setActiveScanConnector] = useState<string | null>(null); // Track which connector was clicked

  const [viewState, setViewState] = useState<Record<string, any> | null>(null);
  const [userHasInteracted, setUserHasInteracted] = useState(false);
  const [shouldAutoRotate, setShouldAutoRotate] = useState(autoRotate); // Track if auto-rotation should be active
  const [isUserDragging, setIsUserDragging] = useState(false); // Track if user is currently dragging
  const isInitialLoadRef = useRef(true); // Track if this is the initial load
  const [popupPosition, setPopupPosition] = useState<{ nodePos: { x: number; y: number } | null; popupPos: { x: number; y: number; lineEnd: { x: number; y: number } } | null }>({ nodePos: null, popupPos: null });
  const nodeClickHandledRef = useRef(false);
  const [legendOpen, setLegendOpen] = useState(false); // Mobile legend open state
  const legendRef = useRef<HTMLDivElement>(null); // Ref for legend container
  const stylesAppliedRef = useRef(false); // Track if label styles have been applied

  // Calculate initial zoom based on screen size to ensure full globe is visible
  const calculateInitialZoom = useCallback(() => {
    if (typeof window === 'undefined') {
      return centerLocation ? 4.8 : 2.5; // Default for SSR
    }

    const width = window.innerWidth;
    const height = window.innerHeight;

    // Base zoom values
    const baseZoom = centerLocation ? 4.8 : 2.5;

    // Calculate zoom adjustment based on screen dimensions
    // Smaller screens need more zoom out to see full globe
    // Use the smaller dimension (width or height) as the limiting factor
    const minDimension = Math.min(width, height);

    // For very small screens (< 400px), zoom out more
    // For medium screens (400-768px), moderate zoom out
    // For larger screens (>= 768px), use base zoom
    let zoomAdjustment = 0;
    if (minDimension < 400) {
      // Very small screens: zoom out significantly
      zoomAdjustment = -0.7;
    } else if (minDimension < 600) {
      // Small screens: zoom out moderately
      zoomAdjustment = -0.5;
    } else if (minDimension < 768) {
      // Medium screens: slight zoom out
      zoomAdjustment = -0.3;
    }
    // Large screens (>= 768px): no adjustment

    return Math.max(1.0, baseZoom + zoomAdjustment); // Ensure minimum zoom of 1.0
  }, [centerLocation]);
  const rotationAnimationRef = useRef<number | null>(null);
  const isProgrammaticRotationRef = useRef(false); // Track if rotation is from our code (not user)
  const popupAnimationRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Refs for direct DOM manipulation (60 FPS without React re-renders)
  const popupPathRef = useRef<SVGPathElement>(null);
  const popupRectRef = useRef<SVGRectElement>(null);
  const popupCardRef = useRef<HTMLDivElement>(null);

  // Smooth position interpolation refs for popup transitions
  const currentPopupPosRef = useRef<{ x: number; y: number } | null>(null);
  const targetPopupPosRef = useRef<{ x: number; y: number } | null>(null);

  // Filter nodes with valid location data and remove duplicates - memoized
  // If no location data, still show nodes (they'll just be at 0,0 or we can skip them)
  const nodesWithLocation = useMemo(() => {
    const withLocation = nodes.filter((node) => node.locationData?.lat !== undefined && node.locationData?.lon !== undefined);

    // Deduplicate by ID and pubkey only (NOT by coordinates!)
    // Multiple nodes at same location are VALID - they're different machines in same data center
    const seenIds = new Set<string>();
    const seenPubkeys = new Set<string>();

    const deduplicated = withLocation.filter((node) => {
      const nodeId = node.id || '';
      const pubkey = node.pubkey || node.publicKey || '';

      // Check if we've seen this exact ID before
      if (nodeId && seenIds.has(nodeId)) {
        return false; // Duplicate by ID
      }

      // Check if we've seen this exact pubkey before
      if (pubkey && seenPubkeys.has(pubkey)) {
        return false; // Duplicate by pubkey
      }

      // Mark as seen
      if (nodeId) seenIds.add(nodeId);
      if (pubkey) seenPubkeys.add(pubkey);

      return true;
    });

    return deduplicated;
  }, [nodes]);

  // Nodes to navigate through - if scan is active, only use scanned nodes, otherwise all nodes
  const navigableNodes = useMemo(() => {
    if (scanTopNodes && scanTopNodes.length > 0) {
      // Filter to only include nodes that are in scanTopNodes and have location data
      const scanNodeIds = new Set(scanTopNodes.map(n => n.id));
      const filtered = nodesWithLocation.filter(node => scanNodeIds.has(node.id));
      console.debug('[MapLibreGlobe] Scan mode: navigableNodes =', filtered.length, 'out of', nodesWithLocation.length, 'total nodes');
      return filtered;
    }
    console.debug('[MapLibreGlobe] Normal mode: navigableNodes =', nodesWithLocation.length);
    return nodesWithLocation;
  }, [scanTopNodes, nodesWithLocation]);

  // Reset navigation index when navigableNodes changes (e.g., when scan results change)
  useEffect(() => {
    setCurrentNodeIndex(-1);
    setSelectedNodeId(null);
  }, [navigableNodes.length]);

  // Create GeoJSON features for nodes with cluster spreading
  // Nodes at the same location get small offsets so they appear as separate bubbles
  const nodeFeatures = useMemo(() => {
    const validNodes = nodesWithLocation.filter((node) => {
      const lon = node.locationData?.lon;
      const lat = node.locationData?.lat;
      return (
        typeof lon === 'number' &&
        !isNaN(lon) &&
        lon >= -180 &&
        lon <= 180 &&
        typeof lat === 'number' &&
        !isNaN(lat) &&
        lat >= -90 &&
        lat <= 90
      );
    });

    // Group nodes by approximate location (for cluster spreading)
    const locationGroups = new Map<string, typeof validNodes>();
    validNodes.forEach((node) => {
      // Round to ~100m precision for grouping
      const key = `${node.locationData!.lat.toFixed(3)},${node.locationData!.lon.toFixed(3)}`;
      if (!locationGroups.has(key)) {
        locationGroups.set(key, []);
      }
      locationGroups.get(key)!.push(node);
    });

    // Create features with offsets for clustered nodes
    return validNodes.map((node) => {
      const key = `${node.locationData!.lat.toFixed(3)},${node.locationData!.lon.toFixed(3)}`;
      const group = locationGroups.get(key) || [node];
      const indexInGroup = group.indexOf(node);
      const groupSize = group.length;

      // Calculate offset for spreading (only if multiple nodes at same spot)
      // Bubble-style: visible at city level, stays together at street level
      let offsetLon = 0;
      let offsetLat = 0;

      if (groupSize > 1) {
        // Bubble map style: clean circular arrangement with optimal packing
        // Base spacing in degrees - compact but visible
        const baseSpacing = 0.0025; // Spacing between node centers

        // First node (index 0) stays at center
        if (indexInGroup > 0) {
          // Calculate which concentric circle/ring this node belongs to
          // Ring 0: center (1 node)
          // Ring 1: up to 6 nodes (evenly spaced circle)
          // Ring 2: up to 12 nodes (second circle)
          // Ring 3: up to 18 nodes (third circle), etc.

          let ring = 0;
          let nodesInPreviousRings = 1;
          let ringCapacity = 6; // First ring can hold 6 nodes

          // Find the ring this node belongs to
          while (indexInGroup >= nodesInPreviousRings + ringCapacity) {
            nodesInPreviousRings += ringCapacity;
            ring++;
            ringCapacity = 6 + ring * 6; // Each ring can hold more nodes
          }

          // Position within this ring
          const positionInRing = indexInGroup - nodesInPreviousRings;
          const nodesInThisRing = Math.min(ringCapacity, groupSize - nodesInPreviousRings);

          // Calculate radius for this ring
          // Each ring is progressively further from center
          // Radius = baseSpacing * (1 + ring * 1.5) for proper spacing
          const ringRadius = baseSpacing * (1.5 + ring * 1.3);

          // Calculate angle - evenly spaced around the circle
          const angleStep = (2 * Math.PI) / nodesInThisRing;
          const angle = positionInRing * angleStep;

          // Add small rotation offset per ring for better visual distribution
          const ringRotation = ring * 0.3; // Rotate each ring slightly
          const finalAngle = angle + ringRotation;

          // Calculate position offset
          offsetLon = ringRadius * Math.cos(finalAngle);
          offsetLat = ringRadius * Math.sin(finalAngle);
        }
      }

      return {
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [
            node.locationData!.lon + offsetLon,
            node.locationData!.lat + offsetLat
          ],
        },
        properties: {
          id: String(node.id || ''),
          pubkey: String(node.pubkey || node.publicKey || ''),
          status: String(node.status || 'offline'),
          location: node.locationData?.city
            ? `${node.locationData.city}, ${node.locationData.country}`
            : String(node.locationData?.country || 'Unknown'),
          version: String(node.version || ''),
          uptime: typeof node.uptimePercent === 'number' ? node.uptimePercent : 0,
          address: String(node.address || ''),
          clusterSize: groupSize, // Include cluster info
          clusterKey: key, // Store cluster key for connections
        },
      };
    });
  }, [nodesWithLocation]);

  // Create cluster connection lines - thin threads connecting nodes in same cluster
  const clusterConnections = useMemo(() => {
    const connections: Array<{
      type: 'Feature';
      geometry: {
        type: 'LineString';
        coordinates: [[number, number], [number, number]];
      };
      properties: Record<string, any>;
    }> = [];

    // Group node features by cluster key
    const clusterGroups = new Map<string, typeof nodeFeatures>();
    nodeFeatures.forEach((feature) => {
      const clusterKey = feature.properties.clusterKey;
      if (clusterKey && feature.properties.clusterSize > 1) {
        if (!clusterGroups.has(clusterKey)) {
          clusterGroups.set(clusterKey, []);
        }
        clusterGroups.get(clusterKey)!.push(feature);
      }
    });

    // Create connections: bubble map network style
    // - All nodes connect to center (hub-and-spoke)
    // - Adjacent nodes in rings connect to each other for network effect
    clusterGroups.forEach((features) => {
      if (features.length <= 1) return;

      const centerFeature = features[0];
      const centerCoords = centerFeature.geometry.coordinates as [number, number];
      const clusterSize = centerFeature.properties.clusterSize;

      // Connect all nodes to center (hub-and-spoke pattern)
      for (let i = 1; i < features.length; i++) {
        const nodeCoords = features[i].geometry.coordinates as [number, number];
        connections.push({
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: [centerCoords, nodeCoords],
          },
          properties: {
            clusterKey: centerFeature.properties.clusterKey,
            clusterSize: clusterSize,
            connectionType: 'hub',
          },
        });
      }

      // For smaller clusters (2-7 nodes), also connect adjacent nodes in ring
      // This creates a more interconnected network bubble map
      if (clusterSize >= 3 && clusterSize <= 7) {
        // Connect each node to the next node in the ring (circular connection)
        for (let i = 1; i < features.length; i++) {
          const nextIndex = i === features.length - 1 ? 1 : i + 1; // Wrap around to first node
          const nodeCoords = features[i].geometry.coordinates as [number, number];
          const nextCoords = features[nextIndex].geometry.coordinates as [number, number];

          connections.push({
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: [nodeCoords, nextCoords],
            },
            properties: {
              clusterKey: centerFeature.properties.clusterKey,
              clusterSize: clusterSize,
              connectionType: 'ring',
            },
          });
        }
      }
    });

    return connections;
  }, [nodeFeatures]);

  // Scan connections: lines from scan location to top 20 nodes
  const scanConnections = useMemo(() => {
    if (!scanLocation || !scanTopNodes || scanTopNodes.length === 0) {
      console.debug('[ScanConnections] Missing data:', {
        hasScanLocation: !!scanLocation,
        hasScanTopNodes: !!scanTopNodes,
        scanTopNodesLength: scanTopNodes?.length || 0
      });
      return [];
    }

    const connections: Array<{
      type: 'Feature';
      geometry: {
        type: 'LineString';
        coordinates: [[number, number], [number, number]];
      };
      properties: {
        targetNodeId: string;
        connectorId: string;
      };
    }> = [];

    console.debug('[ScanConnections] Creating connections:', {
      scanLocation,
      topNodesCount: scanTopNodes.length,
    });

    scanTopNodes.forEach((node) => {
      if (node.locationData?.lat && node.locationData?.lon) {
        const connectorId = `scan-connector-${node.id}`;
        connections.push({
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: [
              [scanLocation.lon, scanLocation.lat],
              [node.locationData.lon, node.locationData.lat],
            ],
          },
          properties: {
            targetNodeId: node.id,
            connectorId,
          },
        });
      } else {
        console.warn('[ScanConnections] Node missing location data:', node.id, node.locationData);
      }
    });

    console.debug('[ScanConnections] Created', connections.length, 'connections');
    return connections;
  }, [scanLocation, scanTopNodes]);

  const handleZoomIn = () => {
    if (mapRef.current) {
      const currentZoom = mapRef.current.getZoom();
      mapRef.current.easeTo({
        zoom: currentZoom + 1,
        duration: 800,
        easing: (t) => 1 - Math.pow(1 - t, 3), // Ease-out cubic
      });
    }
  };

  const handleZoomOut = () => {
    if (mapRef.current) {
      const currentZoom = mapRef.current.getZoom();
      mapRef.current.easeTo({
        zoom: currentZoom - 1,
        duration: 800,
        easing: (t) => 1 - Math.pow(1 - t, 3), // Ease-out cubic
      });
    }
  };

  const handleResetView = () => {
    if (mapRef.current) {
      mapRef.current.flyTo({
        center: [0, 0],
        zoom: 1.5,
        pitch: 0,
        bearing: 0,
        duration: 2000,
      });
    }
  };




  // Calculate distance between two coordinates (in degrees)
  // Simple approximation for globe - good enough for duration calculation
  const calculateDistance = (lon1: number, lat1: number, lon2: number, lat2: number): number => {
    const dLon = lon2 - lon1;
    const dLat = lat2 - lat1;
    return Math.sqrt(dLon * dLon + dLat * dLat);
  };

  // Navigate to a specific node - smart zoom based on cluster size
  const navigateToNode = useCallback((index: number) => {
    if (index < 0 || index >= navigableNodes.length) return;

    // Stop auto-rotation when navigating to a node
    setShouldAutoRotate(false);

    const node = navigableNodes[index];
    if (node.locationData && mapRef.current) {
      setCurrentNodeIndex(index);
      setSelectedNodeId(null); // Hide popup during flight

      const map = mapRef.current.getMap();

      // Get current map center to calculate distance
      const currentCenter = map.getCenter();
      const currentLon = currentCenter.lng;
      const currentLat = currentCenter.lat;

      // Get the offset coordinates for this node (from nodeFeatures)
      // Find the feature by matching node ID since navigableNodes may be a subset
      const nodeId = node.id;
      const feature = nodeFeatures.find(f => f.properties?.id === nodeId);
      const targetLon = feature?.geometry?.coordinates?.[0] ?? node.locationData.lon;
      const targetLat = feature?.geometry?.coordinates?.[1] ?? node.locationData.lat;

      // Calculate distance to determine animation duration
      const distance = calculateDistance(currentLon, currentLat, targetLon, targetLat);

      // Adaptive duration: very close nodes (clustered) get fast animation
      // Distance thresholds in degrees (approx):
      // - < 0.01 degrees (~1km) = very close, 200ms
      // - < 0.1 degrees (~10km) = close, 500ms  
      // - < 1 degree (~100km) = medium, 1200ms
      // - >= 1 degree = far, 2200ms (default)
      let animationDuration: number;
      if (distance < 0.01) {
        animationDuration = 200; // Very close - just a tiny move
      } else if (distance < 0.1) {
        animationDuration = 500; // Close - quick animation
      } else if (distance < 1.0) {
        animationDuration = 1200; // Medium distance
      } else {
        animationDuration = 2200; // Far - full animation
      }

      // Count nodes in this cluster to determine zoom level
      const clusterSize = feature?.properties?.clusterSize ?? 1;

      // Smart zoom: city level for clusters
      // 1 node: zoom 6 (regional view)
      // 2-5 nodes: zoom 11 (city level)
      // 6+ nodes: zoom 13 (very close for clusters)
      let targetZoom: number;
      if (clusterSize <= 1) {
        targetZoom = 6;
      } else if (clusterSize <= 5) {
        targetZoom = 11;
      } else {
        targetZoom = 13;
      }

      // Ensure ALL layers stay visible during animation
      // This prevents lines, labels, and fills from disappearing during camera movements
      const ensureTilesVisible = () => {
        try {
          const style = map.getStyle();
          if (style && style.layers) {
            style.layers.forEach((layer: any) => {
              try {
                // Ensure layer is visible
                const currentVisibility = map.getLayoutProperty(layer.id, 'visibility');
                if (currentVisibility !== 'none') {
                  map.setLayoutProperty(layer.id, 'visibility', 'visible');
                }

                // Keep raster tiles fully opaque
                if (layer.type === 'raster') {
                  map.setPaintProperty(layer.id, 'raster-opacity', 1.0);
                  map.setPaintProperty(layer.id, 'raster-fade-duration', 0);
                }

                // Keep LINE layers (streets, roads, boundaries) visible
                if (layer.type === 'line') {
                  // Get current opacity or default to 1
                  const currentOpacity = map.getPaintProperty(layer.id, 'line-opacity') as number | undefined;
                  if (typeof currentOpacity === 'number' && currentOpacity < 1) {
                    // Don't change if intentionally semi-transparent
                  } else {
                    map.setPaintProperty(layer.id, 'line-opacity', 1.0);
                  }
                }

                // Keep FILL layers (land, water, buildings) visible  
                // Don't modify water layers here - they're handled separately
                if (layer.type === 'fill' && !(
                  layer.id.toLowerCase().includes('water') ||
                  layer.id.toLowerCase().includes('ocean') ||
                  layer.id.toLowerCase().includes('sea') ||
                  layer.id.toLowerCase().includes('marine')
                )) {
                  const currentOpacity = map.getPaintProperty(layer.id, 'fill-opacity') as number | undefined;
                  if (currentOpacity === undefined || (typeof currentOpacity === 'number' && currentOpacity >= 0.5)) {
                    map.setPaintProperty(layer.id, 'fill-opacity', currentOpacity ?? 1.0);
                  }
                }

                // Keep FILL-EXTRUSION layers (3D buildings) visible
                if (layer.type === 'fill-extrusion') {
                  map.setPaintProperty(layer.id, 'fill-extrusion-opacity', 1.0);
                }

                // Keep CIRCLE layers visible
                if (layer.type === 'circle') {
                  map.setPaintProperty(layer.id, 'circle-opacity', 1.0);
                }

                // For SYMBOL layers (labels), prevent culling but don't reset opacity/color
                // This prevents labels from disappearing during animation without resetting styles
                if (layer.type === 'symbol') {
                  map.setLayoutProperty(layer.id, 'text-allow-overlap', true);
                  map.setLayoutProperty(layer.id, 'icon-allow-overlap', true);
                  map.setLayoutProperty(layer.id, 'text-optional', false);
                  map.setLayoutProperty(layer.id, 'icon-optional', false);
                  // Don't reset text-opacity here - it's set by the style application below
                  map.setPaintProperty(layer.id, 'icon-opacity', 1.0);
                }

                // Keep BACKGROUND visible
                if (layer.type === 'background') {
                  map.setPaintProperty(layer.id, 'background-opacity', 1.0);
                }
              } catch (e) {
                // Ignore if property not supported for this layer
              }
            });
          }
        } catch (e) {
          // Ignore if layers don't exist
        }
      };

      // CRITICAL: Keep current viewport tiles loaded during animation
      // The problem is MapLibre unloads current tiles when animation starts
      // We need to prevent this by keeping the source cache active
      try {
        const mapAny = map as any;

        // Get all sources and prevent them from clearing tiles
        const style = map.getStyle();
        if (style && style.sources) {
          Object.keys(style.sources).forEach(sourceId => {
            try {
              const source = map.getSource(sourceId) as any;
              if (source) {
                // Pause tile expiration during animation
                if (source._tileCache) {
                  source._tileCache.max = 1000; // Increase cache size temporarily
                }
                // Mark all current tiles as "used" so they don't get evicted
                if (source._tiles) {
                  Object.values(source._tiles).forEach((tile: any) => {
                    if (tile) {
                      tile.uses = (tile.uses || 0) + 10; // Prevent eviction
                      tile.holdingForFade = true; // Keep for fade transition
                    }
                  });
                }
              }
            } catch (e) { }
          });
        }

        // Force render current frame to ensure all tiles are painted
        if (mapAny.triggerRepaint) {
          mapAny.triggerRepaint();
        }

        // PRE-LOAD destination tiles before animation starts
        // This ensures the destination area is ready when we arrive
        // Pre-load destination area

        // Request tiles for destination at multiple zoom levels
        for (let z = Math.max(1, targetZoom - 3); z <= targetZoom + 1; z++) {
          try {
            // Trigger tile requests by querying features at destination
            map.queryRenderedFeatures(
              map.project([targetLon, targetLat]),
              {}
            );
          } catch (e) { }
        }

      } catch (e) {
        console.debug('Could not preserve current tiles:', e);
      }

      ensureTilesVisible();

      // Single continuous flyTo animation with essential flag
      // Essential prevents the animation from being cancelled by tile loading
      // Duration is adaptive based on distance (fast for close nodes, slower for far)
      mapRef.current.flyTo({
        center: [targetLon, targetLat],
        zoom: targetZoom,
        duration: animationDuration,
        pitch: 0,
        curve: distance < 0.1 ? 1.2 : 1.8, // Tighter curve for close nodes
        speed: distance < 0.1 ? 0.6 : 0.8, // Slower speed for close nodes
        essential: true, // Prevents animation interruption
        easing: (t) => {
          // Smooth ease-in-out quintic
          return t < 0.5
            ? 16 * t * t * t * t * t
            : 1 - Math.pow(-2 * t + 2, 5) / 2;
        },
      });

      // Continuously ensure tiles stay visible during animation using requestAnimationFrame
      // This provides smoother 60 FPS updates on all devices
      let tilePreserveRafId: number | null = null;
      let animationRunning = true;

      const preserveTilesFrame = () => {
        if (!animationRunning) return;

        ensureTilesVisible();

        // Keep current viewport tiles from being unloaded
        try {
          const style = map.getStyle();

          if (style && style.sources) {
            const sourceIds = Object.keys(style.sources);
            for (let i = 0; i < sourceIds.length; i++) {
              try {
                const source = map.getSource(sourceIds[i]) as any;
                if (source && source._tiles) {
                  const tiles = Object.values(source._tiles) as any[];
                  for (let j = 0; j < tiles.length; j++) {
                    const tile = tiles[j];
                    if (tile) {
                      tile.holdingForFade = true;
                      tile.fadeEndTime = performance.now() + 10000;
                      if (tile.state === 'loaded') {
                        tile.wasRequested = true;
                      }
                    }
                  }
                }
              } catch (e) { }
            }
          }
        } catch (e) { }

        // Continue animation loop
        tilePreserveRafId = requestAnimationFrame(preserveTilesFrame);
      };

      // Start tile preservation loop
      tilePreserveRafId = requestAnimationFrame(preserveTilesFrame);

      // Clean up after animation completes
      const onMoveEnd = () => {
        // Stop tile preservation loop
        animationRunning = false;
        if (tilePreserveRafId !== null) {
          cancelAnimationFrame(tilePreserveRafId);
          tilePreserveRafId = null;
        }

        // Restore normal tile behavior after animation
        try {
          const style = map.getStyle();
          if (style && style.sources) {
            Object.keys(style.sources).forEach(sourceId => {
              try {
                const source = map.getSource(sourceId) as any;
                if (source && source._tiles) {
                  Object.values(source._tiles).forEach((tile: any) => {
                    if (tile) {
                      tile.holdingForFade = false;
                    }
                  });
                }
              } catch (e) { }
            });
          }
        } catch (e) { }

        setSelectedNodeId(node.id);
        map.off('moveend', onMoveEnd);
      };

      map.once('moveend', onMoveEnd);
    }
  }, [navigableNodes, nodeFeatures]);

  // Handle scan connector click - toggle between scan location and node
  const handleScanConnectorClick = useCallback((targetNodeId: string, connectorId: string) => {
    if (!mapRef.current || !scanLocation) return;

    const map = mapRef.current.getMap();

    // If we're currently viewing this connector's node, navigate back to scan location
    if (activeScanConnector === connectorId) {
      setActiveScanConnector(null);
      setSelectedNodeId(null);

      map.flyTo({
        center: [scanLocation.lon, scanLocation.lat],
        zoom: 8,
        duration: 1500,
      });
    } else {
      // Navigate to the target node
      setActiveScanConnector(connectorId);

      const nodeIndex = navigableNodes.findIndex(n => n.id === targetNodeId);
      if (nodeIndex >= 0) {
        navigateToNode(nodeIndex);
      }
    }
  }, [scanLocation, activeScanConnector, navigableNodes, navigateToNode]);

  // Navigate to previous node
  const handlePreviousNode = () => {
    // If no node selected yet, go to first node
    if (currentNodeIndex < 0) {
      navigateToNode(0);
      return;
    }
    const newIndex = currentNodeIndex > 0 ? currentNodeIndex - 1 : navigableNodes.length - 1;
    navigateToNode(newIndex);
  };

  // Navigate to next node
  const handleNextNode = () => {
    // If no node selected yet, go to first node
    if (currentNodeIndex < 0) {
      navigateToNode(0);
      return;
    }
    const newIndex = currentNodeIndex < navigableNodes.length - 1 ? currentNodeIndex + 1 : 0;
    navigateToNode(newIndex);
  };

  // Handle map load - start rotation and fit zoom
  const handleMapLoad = useCallback(() => {
    console.log('[Globe] Map loaded');
    setIsLoaded(true);
    isInitialLoadRef.current = true; // Mark as initial load

    // Set initial zoom with subtle animation
    if (mapRef.current && containerRef.current) {
      const containerHeight = containerRef.current.clientHeight;
      // Subtle zoom calculation - stay closer to default
      const zoom = Math.max(2.3, Math.min(2.7, 2.5 + (containerHeight - 600) / 2000));

      // Use easeTo for smooth but subtle zoom animation
      mapRef.current.easeTo({
        zoom: zoom,
        duration: 800, // Shorter duration for subtle animation
        easing: (t) => t * (2 - t), // Ease out
      });

      // Mark initial load as complete after zoom animation
      setTimeout(() => {
        isInitialLoadRef.current = false;
      }, 1000);
    }
  }, []);

  // Calculate zoom to fit globe height in container
  const calculateFitZoom = useCallback(() => {
    if (!containerRef.current) return 2.5;
    const containerHeight = containerRef.current.clientHeight;
    // For globe projection, approximate zoom based on container height
    // Smaller containers need higher zoom, larger containers need lower zoom
    // Formula: zoom = log2(containerHeight / baseHeight) + baseZoom
    const baseHeight = 600; // Reference height
    const baseZoom = 2.5; // Base zoom level
    const zoom = Math.log2(containerHeight / baseHeight) + baseZoom;
    // Clamp between 2.3 and 3.7
    return Math.max(2.3, Math.min(3.7, zoom));
  }, []);

  // Handle clicks outside legend to close it on mobile
  useEffect(() => {
    if (!legendOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (legendRef.current && !legendRef.current.contains(event.target as Node)) {
        setLegendOpen(false);
      }
    };

    // Add event listener with a small delay to avoid immediate closure
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [legendOpen]);

  // Sync shouldAutoRotate state with autoRotate prop
  useEffect(() => {
    // If autoRotate prop is explicitly false, ensure rotation is disabled
    if (!autoRotate) {
      setShouldAutoRotate(false);
    }
  }, [autoRotate]);

  // Auto-rotation logic - starts immediately when globe loads, stops on user interaction or node navigation
  useEffect(() => {
    console.log('[Globe Rotation] Effect triggered:', {
      isLoaded,
      shouldAutoRotate,
      hasMapRef: !!mapRef.current,
      currentNodeIndex,
      navigateToNodeId,
      isUserDragging
    });

    // Don't start rotation if map isn't loaded, user has interacted, navigated to node, or map ref is missing
    if (!isLoaded || !shouldAutoRotate || !mapRef.current || currentNodeIndex >= 0 || navigateToNodeId) {
      console.log('[Globe Rotation] Not starting - conditions not met');
      if (rotationAnimationRef.current) {
        cancelAnimationFrame(rotationAnimationRef.current);
        rotationAnimationRef.current = null;
      }
      return;
    }

    console.log('[Globe Rotation] Starting rotation!');
    let lastTime = performance.now();
    const rotationSpeed = 3; // degrees per second (horizontal rotation around X axis)

    const rotate = (currentTime: number) => {
      // Stop rotation if user has interacted, navigated to node, is dragging, or map is gone
      if (!shouldAutoRotate || currentNodeIndex >= 0 || navigateToNodeId || isUserDragging || !mapRef.current) {
        if (rotationAnimationRef.current) {
          cancelAnimationFrame(rotationAnimationRef.current);
          rotationAnimationRef.current = null;
        }
        return;
      }

      const deltaTime = (currentTime - lastTime) / 1000; // Convert to seconds
      lastTime = currentTime;

      if (mapRef.current && deltaTime > 0 && deltaTime < 1) { // Sanity check for deltaTime
        try {
          const map = mapRef.current.getMap();
          // Rotate around X axis (horizontal rotation) by changing longitude
          const currentCenter = map.getCenter();
          const newLon = (currentCenter.lng + rotationSpeed * deltaTime) % 360;

          // Mark that we're doing programmatic rotation to prevent move events from stopping it
          isProgrammaticRotationRef.current = true;
          // Keep latitude at centerLocation if provided, otherwise 15 degrees to show more of Europe/Northern hemisphere
          const targetLat = centerLocation?.lat ?? 15;
          map.setCenter([newLon, targetLat]);
          // Reset flag after a brief moment (move events fire asynchronously)
          setTimeout(() => {
            isProgrammaticRotationRef.current = false;
          }, 50);
        } catch (e) {
          console.error('Rotation error:', e);
          isProgrammaticRotationRef.current = false;
        }
      }

      rotationAnimationRef.current = requestAnimationFrame(rotate);
    };

    // Start rotation immediately (don't wait for zoom animation)
    rotationAnimationRef.current = requestAnimationFrame(rotate);

    return () => {
      console.log('[Globe Rotation] Cleaning up');
      if (rotationAnimationRef.current) {
        cancelAnimationFrame(rotationAnimationRef.current);
        rotationAnimationRef.current = null;
      }
    };
  }, [isLoaded, shouldAutoRotate, currentNodeIndex, navigateToNodeId, isUserDragging]);

  // Handle user interaction - stop rotation permanently
  const handleUserInteraction = useCallback(() => {
    // Ignore interactions during initial load (zoom animation)
    if (isInitialLoadRef.current) {
      return;
    }

    // Ignore move events that are from our programmatic rotation
    if (isProgrammaticRotationRef.current) {
      return;
    }

    if (!userHasInteracted) {
      setUserHasInteracted(true);
    }
    // Stop auto-rotation when user interacts
    setShouldAutoRotate(false);
  }, [userHasInteracted]);

  // Handle drag start - pause rotation during drag
  const handleDragStart = useCallback(() => {
    setIsUserDragging(true);
    // Stop rotation permanently when user starts dragging
    setShouldAutoRotate(false);
    if (!userHasInteracted) {
      setUserHasInteracted(true);
    }
  }, [userHasInteracted]);

  // Handle drag end - rotation stays stopped (user has interacted)
  const handleDragEnd = useCallback(() => {
    setIsUserDragging(false);
    // Rotation stays stopped after drag
    setShouldAutoRotate(false);
    if (!userHasInteracted) {
      setUserHasInteracted(true);
    }
  }, [userHasInteracted]);

  // Keyboard navigation (arrow keys)
  useEffect(() => {
    if (!isLoaded || navigableNodes.length === 0) return;

    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePreviousNode();
        handleUserInteraction();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNextNode();
        handleUserInteraction();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isLoaded, currentNodeIndex, navigableNodes.length, handlePreviousNode, handleNextNode, handleUserInteraction]);

  const handleMarkerClick = (nodeId: string, index: number) => {
    navigateToNode(index);

    // If onNodeClick callback is provided (e.g., in Scan page), use it instead of navigating
    if (onNodeClick) {
      const node = navigableNodes[index];
      if (node) {
        onNodeClick(node);
      }
    } else {
      // Only navigate to /nodes page if no callback provided (e.g., in Overview page)
      startProgress();
      router.push(`/nodes/${nodeId}`);
    }
  };


  // Get screen position of a node (relative to viewport for fixed positioning)
  const getNodeScreenPosition = useCallback((lon: number, lat: number): { x: number; y: number } | null => {
    if (!mapRef.current || !containerRef.current) return null;

    try {
      const map = mapRef.current.getMap();
      const point = map.project([lon, lat]);

      // Get the map container's position relative to viewport
      const containerRect = containerRef.current.getBoundingClientRect();

      // Add container offset to get viewport-relative coordinates
      return {
        x: point.x + containerRect.left,
        y: point.y + containerRect.top
      };
    } catch (e) {
      return null;
    }
  }, []);

  // Check if a node is on the visible side of the globe (not hidden behind it)
  const isNodeVisible = useCallback((lon: number, lat: number): boolean => {
    if (!mapRef.current || !viewState) return true;

    try {
      const map = mapRef.current.getMap();
      const point = map.project([lon, lat]);

      // Get canvas dimensions
      const canvas = map.getCanvasContainer();
      if (!canvas) return true;

      const canvasWidth = canvas.clientWidth;
      const canvasHeight = canvas.clientHeight;

      // Check if the projected point is within reasonable bounds
      // Points on the back of the globe will be projected far outside the viewport
      const margin = Math.max(canvasWidth, canvasHeight) * 0.3;

      // If the point is way outside the canvas, it's likely on the back of the globe
      if (point.x < -margin || point.x > canvasWidth + margin ||
        point.y < -margin || point.y > canvasHeight + margin) {
        return false;
      }

      // Additional check: for globe projection, calculate if point is on front hemisphere
      // Convert lat/lon to radians
      const nodeLatRad = lat * Math.PI / 180;
      const nodeLonRad = lon * Math.PI / 180;
      const centerLatRad = viewState.latitude * Math.PI / 180;
      const centerLonRad = viewState.longitude * Math.PI / 180;

      // Calculate great circle distance and check if on front hemisphere
      // Simplified: if the point is more than 90 degrees away from center, it might be on back
      const dLat = nodeLatRad - centerLatRad;
      const dLon = nodeLonRad - centerLonRad;
      const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(centerLatRad) * Math.cos(nodeLatRad) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distance = c * 180 / Math.PI; // Distance in degrees

      // If the node is more than ~100 degrees from center, it's likely on the back
      // But we also need to account for the bearing/rotation
      // For now, use the screen position check as primary, distance as secondary
      if (distance > 100 && (point.x < 0 || point.x > canvasWidth || point.y < 0 || point.y > canvasHeight)) {
        return false;
      }

      return true;
    } catch (e) {
      return true; // Default to visible if we can't determine
    }
  }, [viewState]);

  // Update view state on map move
  useEffect(() => {
    if (!mapRef.current) return;

    const map = mapRef.current.getMap();
    const updateViewState = () => {
      const center = map.getCenter();
      const zoom = map.getZoom();
      const pitch = map.getPitch();
      const bearing = map.getBearing();

      setViewState({
        longitude: center.lng,
        latitude: center.lat,
        zoom,
        pitch,
        bearing,
      });
    };

    map.on('move', updateViewState);
    map.on('zoom', updateViewState);
    map.on('pitch', updateViewState);
    map.on('rotate', updateViewState);

    updateViewState();

    return () => {
      map.off('move', updateViewState);
      map.off('zoom', updateViewState);
      map.off('pitch', updateViewState);
      map.off('rotate', updateViewState);
    };
  }, [isLoaded]);

  // Center on scan location when it changes
  useEffect(() => {
    if (centerLocation && mapRef.current && isLoaded) {
      mapRef.current.flyTo({
        center: [centerLocation.lon, centerLocation.lat],
        zoom: 4,
        duration: 2000,
        easing: (t) => 1 - Math.pow(1 - t, 3), // Ease-out cubic
      });
    }
  }, [centerLocation, isLoaded]);

  // Navigate to node when navigateToNodeId changes (from search)
  useEffect(() => {
    if (navigateToNodeId && mapRef.current && isLoaded && navigableNodes.length > 0) {
      // Stop auto-rotation when navigating to a node
      setShouldAutoRotate(false);

      console.log('[Globe Navigation] Looking for node:', navigateToNodeId, 'in', navigableNodes.length, 'navigable nodes');

      // Find the node by ID, pubkey, publicKey, or IP address
      const nodeIndex = navigableNodes.findIndex(n =>
        n.id === navigateToNodeId ||
        n.pubkey === navigateToNodeId ||
        n.publicKey === navigateToNodeId ||
        n.address?.split(':')[0] === navigateToNodeId
      );

      console.log('[Globe Navigation] Found node at index:', nodeIndex);

      if (nodeIndex >= 0) {
        console.log('[Globe Navigation] Navigating to node index:', nodeIndex);
        navigateToNode(nodeIndex);
      } else {
        console.log('[Globe Navigation] Node not found in navigable nodes. Available identifiers:',
          navigableNodes.slice(0, 3).map(n => ({ id: n.id, pubkey: n.pubkey, publicKey: n.publicKey, address: n.address }))
        );
      }
    }
  }, [navigateToNodeId, isLoaded, navigableNodes, navigateToNode]);

  // Continuous 60 FPS popup position updates using requestAnimationFrame loop
  // Direct DOM manipulation for smooth performance on all devices
  useEffect(() => {
    if (!selectedNodeId || !isLoaded || !mapRef.current) {
      setPopupPosition({ nodePos: null, popupPos: null });
      // Reset position refs when popup closes
      currentPopupPosRef.current = null;
      targetPopupPosRef.current = null;
      if (popupAnimationRef.current !== null) {
        cancelAnimationFrame(popupAnimationRef.current);
        popupAnimationRef.current = null;
      }
      return;
    }

    const nodeIndex = nodesWithLocation.findIndex(n => n.id === selectedNodeId);
    if (nodeIndex < 0) {
      setPopupPosition({ nodePos: null, popupPos: null });
      return;
    }

    const selectedNode = nodesWithLocation[nodeIndex];
    if (!selectedNode?.locationData) {
      setPopupPosition({ nodePos: null, popupPos: null });
      return;
    }

    const feature = nodeFeatures[nodeIndex];
    const displayLon = feature?.geometry?.coordinates?.[0] ?? selectedNode.locationData.lon;
    const displayLat = feature?.geometry?.coordinates?.[1] ?? selectedNode.locationData.lat;

    // Constants (increased by 20%)
    const popupWidth = 336; // 280 * 1.2
    const popupHeight = 192; // 160 * 1.2
    const margin = 20;

    // Mobile detection and offsets
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    // Search bar is at top-4 (16px) + search bar height (~50px) + some padding = ~80px
    const mobileTopOffset = isMobile ? 80 : 0;
    // Bottom controls (navigation + zoom) are at bottom-4 (16px) + control height (~60px) + some padding = ~100px
    const mobileBottomOffset = isMobile ? 100 : 0;

    // Continuous 60 FPS animation loop
    const animate = () => {
      const nodePos = getNodeScreenPosition(displayLon, displayLat);
      const containerRect = containerRef.current?.getBoundingClientRect();

      if (!nodePos || !containerRect) {
        popupAnimationRef.current = requestAnimationFrame(animate);
        return;
      }

      const containerLeft = containerRect.left;
      const containerTop = containerRect.top;
      const containerWidth = containerRect.width;
      const containerHeight = containerRect.height;

      // Re-check mobile on each frame (in case window was resized)
      const currentIsMobile = typeof window !== 'undefined' && window.innerWidth < 768;
      const currentMobileTopOffset = currentIsMobile ? 80 : 0;
      const currentMobileBottomOffset = currentIsMobile ? 100 : 0;

      const nodeRelativeX = nodePos.x - containerLeft;
      const isNodeOnRight = nodeRelativeX > containerWidth / 2;

      // Calculate target position
      let targetPopupX: number;
      let targetPopupY: number;
      let lineEndX: number;
      let lineEndY: number;

      if (isNodeOnRight) {
        targetPopupX = containerLeft + margin + (currentIsMobile ? 0 : 60); // Shift right on desktop to avoid covering zoom buttons
        // Add mobile offset to prevent covering bottom controls
        targetPopupY = containerTop + containerHeight - popupHeight - margin - currentMobileBottomOffset;
        lineEndX = popupWidth / 2;
        lineEndY = 0;
      } else {
        targetPopupX = containerLeft + containerWidth - popupWidth - margin;
        // Add mobile offset to prevent covering search bar
        targetPopupY = containerTop + margin + currentMobileTopOffset;
        lineEndX = popupWidth / 2;
        lineEndY = popupHeight;
      }

      // Update target position ref
      targetPopupPosRef.current = { x: targetPopupX, y: targetPopupY };

      // Initialize current position if not set (only on first appearance)
      if (!currentPopupPosRef.current) {
        currentPopupPosRef.current = { x: targetPopupX, y: targetPopupY };
      }

      // Ultra-smooth interpolation with cubic ease-out curve
      const currentPos = currentPopupPosRef.current;
      const targetPos = targetPopupPosRef.current;
      const dx = targetPos.x - currentPos.x;
      const dy = targetPos.y - currentPos.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Base easing factors - slower for smoother feel
      let baseEasingFactor: number;
      if (distance > 500) {
        // Very large jumps (side switches): ultra-smooth (~60-80 frames)
        baseEasingFactor = 0.035;
      } else if (distance > 300) {
        // Large jumps: very smooth (~50-60 frames)
        baseEasingFactor = 0.045;
      } else if (distance > 150) {
        // Medium-large jumps: smooth (~35-45 frames)
        baseEasingFactor = 0.06;
      } else if (distance > 50) {
        // Medium jumps: moderate smooth (~25-35 frames)
        baseEasingFactor = 0.08;
      } else if (distance > 10) {
        // Small adjustments: smooth but responsive (~12-18 frames)
        baseEasingFactor = 0.12;
      } else {
        // Very small adjustments: quick but smooth (~6-10 frames)
        baseEasingFactor = 0.20;
      }

      // Apply cubic ease-out: smooth deceleration curve
      // This creates natural, fluid motion that feels organic
      const normalizedDistance = Math.min(distance / 600, 1); // Normalize to 0-1
      const t = 1 - normalizedDistance; // Invert for ease-out
      const easeOut = 1 - Math.pow(1 - t, 3); // Cubic ease-out: smooth deceleration

      // Combine base easing with ease-out curve for ultra-smooth motion
      // The ease-out makes it slow down gracefully as it approaches target
      const finalEasing = baseEasingFactor * (0.6 + 0.4 * easeOut);

      const moveX = dx * finalEasing;
      const moveY = dy * finalEasing;

      // Only snap when extremely close (prevents endless micro-movements)
      if (distance < 0.15) {
        currentPos.x = targetPos.x;
        currentPos.y = targetPos.y;
      } else {
        currentPos.x += moveX;
        currentPos.y += moveY;
      }

      // Use interpolated position for rendering
      const popupX = currentPos.x;
      const popupY = currentPos.y;

      // Calculate path using interpolated position
      const lineEndAbsX = popupX + lineEndX;
      const lineEndAbsY = popupY + lineEndY;
      const midX = (nodePos.x + lineEndAbsX) / 2;
      const midY = (nodePos.y + lineEndAbsY) / 2 - 20;
      const pathD = `M ${nodePos.x} ${nodePos.y} Q ${midX} ${midY} ${lineEndAbsX} ${lineEndAbsY}`;

      // Direct DOM manipulation for 60 FPS (bypasses React re-renders)
      // Rect and div are perfectly synced - div sits exactly inside stroke
      if (popupPathRef.current) {
        popupPathRef.current.setAttribute('d', pathD);
      }

      if (popupRectRef.current) {
        // Rect position (stroke is centered on this path)
        popupRectRef.current.setAttribute('x', String(popupX));
        popupRectRef.current.setAttribute('y', String(popupY));
      }

      if (popupCardRef.current) {
        // Div sits 1px inside the stroke (stroke is 2px, centered on path)
        popupCardRef.current.style.left = `${popupX + 1}px`;
        popupCardRef.current.style.top = `${popupY + 1}px`;
      }

      // Continue animation loop
      popupAnimationRef.current = requestAnimationFrame(animate);
    };

    // Set initial state for React render and start animation immediately
    const initializePopup = () => {
      const initialNodePos = getNodeScreenPosition(displayLon, displayLat);
      const initialContainerRect = containerRef.current?.getBoundingClientRect();

      if (initialNodePos && initialContainerRect) {
        const nodeRelativeX = initialNodePos.x - initialContainerRect.left;
        const isNodeOnRight = nodeRelativeX > initialContainerRect.width / 2;

        // Check mobile for initial positioning
        const initialIsMobile = typeof window !== 'undefined' && window.innerWidth < 768;
        const initialMobileTopOffset = initialIsMobile ? 80 : 0;
        const initialMobileBottomOffset = initialIsMobile ? 100 : 0;

        let popupX: number;
        let popupY: number;
        let lineEndY: number;

        if (isNodeOnRight) {
          popupX = initialContainerRect.left + margin + (initialIsMobile ? 0 : 60); // Shift right on desktop to avoid covering zoom buttons
          // Add mobile offset to prevent covering bottom controls
          popupY = initialContainerRect.top + initialContainerRect.height - popupHeight - margin - initialMobileBottomOffset;
          lineEndY = 0;
        } else {
          popupX = initialContainerRect.left + initialContainerRect.width - popupWidth - margin;
          // Add mobile offset to prevent covering search bar
          popupY = initialContainerRect.top + margin + initialMobileTopOffset;
          lineEndY = popupHeight;
        }

        // Only update React state if popup position refs don't exist (first render)
        // This prevents React re-renders from interfering with smooth animations
        if (!currentPopupPosRef.current) {
          // First time: set current and target to same position (no transition needed)
          currentPopupPosRef.current = { x: popupX, y: popupY };
          targetPopupPosRef.current = { x: popupX, y: popupY };

          // Set initial React state only once
          setPopupPosition({
            nodePos: initialNodePos,
            popupPos: {
              x: popupX,
              y: popupY,
              lineEnd: { x: popupWidth / 2, y: lineEndY },
            },
          });

          // Immediately set initial position via refs (only on first appearance)
          if (popupCardRef.current) {
            popupCardRef.current.style.left = `${popupX + 1}px`;
            popupCardRef.current.style.top = `${popupY + 1}px`;
          }
          if (popupRectRef.current) {
            popupRectRef.current.setAttribute('x', String(popupX));
            popupRectRef.current.setAttribute('y', String(popupY));
          }
        } else {
          // Popup already exists: only update target, let animation loop handle smooth transition
          // Don't update React state or touch DOM - animation loop handles everything smoothly
          targetPopupPosRef.current = { x: popupX, y: popupY };
        }
      }
    };

    // Initialize immediately
    initializePopup();

    // Start continuous 60 FPS animation loop immediately
    // The animation loop handles all position updates after initial setup
    popupAnimationRef.current = requestAnimationFrame(animate);

    return () => {
      if (popupAnimationRef.current !== null) {
        cancelAnimationFrame(popupAnimationRef.current);
        popupAnimationRef.current = null;
      }
    };
  }, [selectedNodeId, isLoaded, nodesWithLocation, nodeFeatures, getNodeScreenPosition]);

  // Note: Click handling is done via layer-specific events in useEffect below
  // This avoids queryRenderedFeatures errors with vector tiles

  // Set up click and hover handlers for nodes layer
  useEffect(() => {
    if (!isLoaded || !mapRef.current || nodeFeatures.length === 0) return;

    const setupHandlers = () => {
      const map = mapRef.current?.getMap();
      if (!map) {
        console.debug('Map not available for handlers');
        return false;
      }

      try {
        // Check if layer exists - retry if not ready yet
        if (!map.getLayer('nodes-layer')) {
          console.debug('nodes-layer not found yet, will retry...');
          // Retry after a short delay
          setTimeout(() => {
            if (map.getLayer('nodes-layer')) {
              setupHandlers();
            }
          }, 500);
          return false;
        }

        console.debug('Setting up click and hover handlers for nodes-layer');

        // Remove existing listeners - we'll set them up fresh below
        try {
          (map as any).off('click', 'nodes-layer');
          (map as any).off('mouseenter', 'nodes-layer');
          (map as any).off('mouseleave', 'nodes-layer');
        } catch (e) {
          // Ignore if no listeners exist
        }

        // Set up click handler on the layer - this avoids queryRenderedFeatures errors
        const layerClickHandler = (e: any) => {
          console.debug('Node layer clicked!', e);

          // Mark that we handled a node click - this prevents map-level handler from closing popup
          nodeClickHandledRef.current = true;

          // Stop event propagation to prevent map-level click handlers from firing
          if ((e as any).originalEvent) {
            (e as any).originalEvent.stopPropagation();
            (e as any).originalEvent.stopImmediatePropagation();
          }

          if (e.features && e.features.length > 0) {
            const feature = e.features[0];
            const nodeId = feature.properties?.id;
            console.debug('Node clicked! ID:', nodeId, 'Feature:', feature, 'Properties:', feature.properties);

            if (nodeId && typeof nodeId === 'string') {
              // Find the node
              const clickedNode = navigableNodes.find(n => n.id === nodeId);

              if (clickedNode && onNodeClick) {
                // Call the onNodeClick callback to open node detail modal
                onNodeClick(clickedNode);
                handleUserInteraction();
              } else {
                // Fallback to existing popup behavior if no callback provided
                const nodeIndex = navigableNodes.findIndex(n => n.id === nodeId);
                if (nodeIndex >= 0) {
                  // Navigate to the node (this will open the popup after navigation completes)
                  navigateToNode(nodeIndex);
                }
                handleUserInteraction();
              }

              // Reset flag after a short delay to allow map handler to check it
              setTimeout(() => {
                nodeClickHandledRef.current = false;
              }, 50);
            } else {
              console.warn('Node clicked but invalid nodeId:', nodeId);
              nodeClickHandledRef.current = false;
            }
          } else {
            console.debug('Node layer clicked but no features found at click point');
            nodeClickHandledRef.current = false;
          }
        };

        // Use type assertion to avoid TypeScript errors with layer-specific handlers
        // Use capture phase to handle before map-level handler
        (map as any).on('click', 'nodes-layer', layerClickHandler);

        // Set up click handler for scan connector lines
        const scanConnectorClickHandler = (e: any) => {
          console.debug('Scan connector clicked!', e);

          // Stop event propagation to prevent map-level handler from firing
          if ((e as any).originalEvent) {
            (e as any).originalEvent.stopPropagation();
            (e as any).originalEvent.stopImmediatePropagation();
          }

          if (e.features && e.features.length > 0) {
            const feature = e.features[0];
            const connectorId = feature.properties?.connectorId;
            const targetNodeId = feature.properties?.targetNodeId;

            if (connectorId && targetNodeId) {
              handleScanConnectorClick(targetNodeId, connectorId);
              handleUserInteraction();
            }
          }
        };

        (map as any).on('click', 'scan-connections-layer', scanConnectorClickHandler);

        // Also set up a map-level click handler to close popup when clicking elsewhere
        // Store handler reference for cleanup
        const mapClickHandler = (e: any) => {
          // Stop rotation when map is clicked
          setShouldAutoRotate(false);
          if (!userHasInteracted) {
            setUserHasInteracted(true);
          }

          // If we just handled a node click, don't close the popup
          if (nodeClickHandledRef.current) {
            console.debug('Map click handler: node click was handled, ignoring');
            return;
          }

          // Check if we clicked on a node layer
          const clickedOnNode = e.features?.some((f: any) =>
            f.layer?.id === 'nodes-layer' || f.sourceLayer === 'nodes-layer'
          );

          // Only close if we didn't click on a node
          if (!clickedOnNode) {
            setSelectedNodeId((currentId) => {
              if (currentId) {
                console.debug('Map clicked (not on node), closing popup');
                return null;
              }
              return currentId;
            });
          }
        };

        // Add map-level click handler (runs after layer-specific handlers)
        map.on('click', mapClickHandler);

        // Store handler reference for cleanup
        (map as any)._mapClickHandler = mapClickHandler;

        // Set up hover handlers using layer-specific events (avoids queryRenderedFeatures errors)
        const handleMouseEnter = () => {
          const canvas = map.getCanvas();
          if (canvas) {
            canvas.style.cursor = 'pointer';
          }
          // Also set on the container to ensure it works
          const container = canvas.parentElement;
          if (container) {
            container.style.cursor = 'pointer';
          }
        };

        const handleMouseLeave = () => {
          const canvas = map.getCanvas();
          if (canvas) {
            canvas.style.cursor = '';
          }
          // Also reset on the container
          const container = canvas.parentElement;
          if (container) {
            container.style.cursor = '';
          }
        };

        // Use layer-specific mouseenter/mouseleave to avoid queryRenderedFeatures
        // These events are triggered by MapLibre when the mouse enters/leaves features in the layer
        (map as any).on('mouseenter', 'nodes-layer', handleMouseEnter);
        (map as any).on('mouseleave', 'nodes-layer', handleMouseLeave);

        // Suppress MapLibre's internal queryRenderedFeatures errors by wrapping it
        // This prevents "unknown feature value" errors from crashing the app
        const originalQueryRenderedFeatures = map.queryRenderedFeatures.bind(map);
        map.queryRenderedFeatures = function (...args: any[]) {
          try {
            return originalQueryRenderedFeatures(...args);
          } catch (error: any) {
            // Suppress "unknown feature value" errors - these are often from map style tiles
            if (error?.message?.includes('unknown feature value')) {
              console.debug('Suppressed queryRenderedFeatures error:', error.message);
              return [];
            }
            throw error;
          }
        };

        console.debug('Click and hover handlers set up successfully');
        return true;
      } catch (e) {
        console.error('Error setting up handlers:', e);
        return false;
      }
    };

    // Try immediately, then retry if layer doesn't exist yet
    let timeoutId: NodeJS.Timeout | null = null;
    let handlersSetup = false;

    const trySetup = () => {
      if (setupHandlers()) {
        handlersSetup = true;
      } else if (!handlersSetup) {
        timeoutId = setTimeout(() => {
          if (!setupHandlers()) {
            setTimeout(setupHandlers, 1000);
          }
        }, 500);
      }
    };

    trySetup();

    // Cleanup function
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      // Clean up listeners when component unmounts or dependencies change
      const map = mapRef.current?.getMap();
      if (map) {
        try {
          (map as any).off('click', 'nodes-layer');
          (map as any).off('click', 'scan-connections-layer');
          // Remove map-level click handler if it exists
          if ((map as any)._mapClickHandler) {
            map.off('click', (map as any)._mapClickHandler);
            delete (map as any)._mapClickHandler;
          }
          (map as any).off('mouseenter', 'nodes-layer');
          (map as any).off('mouseleave', 'nodes-layer');
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    };
  }, [isLoaded, nodesWithLocation.length, handleUserInteraction]);

  // Inject styles into document head
  useEffect(() => {
    const styleId = 'maplibre-globe-styles';
    if (document.getElementById(styleId)) {
      return; // Styles already injected
    }

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes extendLine {
          from {
            stroke-dashoffset: 100;
          }
          to {
            stroke-dashoffset: 0;
          }
        }
        @keyframes retractLine {
          from {
            stroke-dashoffset: 0;
          }
          to {
            stroke-dashoffset: 100;
          }
        }
        @keyframes bubbleIn {
          from {
            opacity: 0;
            transform: translate3d(0, 4px, 0) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translate3d(0, 0, 0) scale(1);
          }
        }
        @keyframes dash {
          from {
            stroke-dashoffset: 0;
          }
          to {
            stroke-dashoffset: -12;
          }
        }
        /* 60 FPS optimizations for all devices */
        .gpu-accelerated {
          transform: translateZ(0);
          backface-visibility: hidden;
          -webkit-backface-visibility: hidden;
          will-change: transform;
        }
        @keyframes elasticFollow {
          0% {
            transform: translate(0, 0) scale(1);
          }
          50% {
            transform: translate(2px, -2px) scale(1.01);
          }
          100% {
            transform: translate(0, 0) scale(1);
          }
        }
        /* Smooth map interactions */
        .maplibregl-canvas-container,
        .maplibregl-canvas {
          transition: transform 0.1s cubic-bezier(0.4, 0, 0.2, 1);
        }
        /* Smooth scrolling */
        * {
          scroll-behavior: smooth;
        }
        .maplibregl-ctrl-attrib {
          display: none !important;
        }
        /* Ensure cursor changes work properly for interactive layers */
        .maplibregl-canvas-container.maplibregl-interactive {
          cursor: default;
        }
      `;
    document.head.appendChild(style);

    return () => {
      const existingStyle = document.getElementById(styleId);
      if (existingStyle) {
        existingStyle.remove();
      }
    };
  }, []);

  return (
    <>
      <div
        ref={containerRef}
        className="absolute inset-0 w-full h-full overflow-hidden"
        style={{
          backgroundColor: '#000000',
        }}
      >
        <MapGL
          ref={mapRef}
          mapLib={maplibregl}
          initialViewState={{
            longitude: centerLocation?.lon ?? 0,
            latitude: centerLocation?.lat ?? 15, // Tilt globe forward to show more of Europe/northern hemisphere
            // Calculate zoom dynamically based on screen size to ensure full globe is visible
            zoom: calculateInitialZoom(),
            pitch: 0,
            bearing: 0,
          }}
          maxZoom={15}
          style={{ width: '100%', height: '100%', backgroundColor: 'transparent', position: 'relative', zIndex: 1 }}
          mapStyle="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
          reuseMaps={true}
          projection="globe"
          attributionControl={false}
          maxTileCacheSize={256}
          refreshExpiredTiles={false}
          renderWorldCopies={true}
          fadeDuration={0}
          onMoveStart={handleUserInteraction}
          onMoveEnd={handleUserInteraction}
          onZoomStart={handleUserInteraction}
          onZoomEnd={handleUserInteraction}
          onRotateStart={handleUserInteraction}
          onRotateEnd={handleUserInteraction}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onPitchStart={handleUserInteraction}
          onPitchEnd={handleUserInteraction}
          onLoad={() => {
            handleMapLoad();
            // Preload and cache tiles to prevent flashing
            if (mapRef.current) {
              const map = mapRef.current.getMap();

              // Disable fade transitions to prevent flashing (if using raster layers)
              try {
                const style = map.getStyle();
                if (style && style.layers) {
                  style.layers.forEach((layer: any) => {
                    if (layer.type === 'raster') {
                      try {
                        map.setPaintProperty(layer.id, 'raster-fade-duration', 0);
                      } catch (e) { }
                    }
                  });
                }
              } catch (e) {
                // Ignore if property doesn't exist
              }

              // Set globe atmosphere/fog for premium look
              try {
                const mapAny = map as any;
                if (typeof mapAny.setFog === 'function') {
                  mapAny.setFog({
                    color: '#0a0f1a', // Deep blue-black atmosphere
                    'high-color': '#1a2744', // Slightly blue horizon glow
                    'space-color': '#000000', // Pure black space
                    'horizon-blend': 0.08, // Subtle atmosphere blend
                    'star-intensity': 0.15, // Subtle stars in space
                  });
                } else if (typeof mapAny.setAtmosphere === 'function') {
                  mapAny.setAtmosphere({
                    color: '#0a0f1a',
                    highColor: '#1a2744',
                    spaceColor: '#000000',
                    horizonBlend: 0.08,
                  });
                }
              } catch (e) {
                // Fog/atmosphere might not be available in all versions
              }

              // Apply water and land colors immediately on load (before style is fully rendered to prevent flashing)
              const applyFillColors = () => {
                try {
                  const style = map.getStyle();
                  if (style && style.layers) {
                    // Log all fill layers to debug
                    const fillLayers = style.layers.filter((l: any) => l.type === 'fill');
                    console.debug('Found fill layers:', fillLayers.map((l: any) => l.id));

                    style.layers.forEach((layer: any) => {
                      // Set background layer (land) to black
                      if (layer.type === 'background') {
                        try {
                          console.debug('Setting background (land) color to black');
                          map.setPaintProperty(layer.id, 'background-color', '#000000');
                        } catch (e) {
                          console.debug('Could not set background color:', e);
                        }
                      }

                      if (layer.type === 'fill') {
                        const isWater = layer.id.toLowerCase().includes('water') ||
                          layer.id.toLowerCase().includes('ocean') ||
                          layer.id.toLowerCase().includes('sea') ||
                          layer.id.toLowerCase().includes('marine');

                        try {
                          if (isWater) {
                            // Water: match sidebar background color
                            console.debug('Setting water color for layer:', layer.id);
                            map.setPaintProperty(layer.id, 'fill-color', '#0f0f0f');
                          } else {
                            // Land/landcover: black
                            console.debug('Setting land color to black for layer:', layer.id);
                            map.setPaintProperty(layer.id, 'fill-color', '#000000');
                          }
                          map.setPaintProperty(layer.id, 'fill-opacity', 1.0);
                        } catch (e) {
                          console.debug('Could not set fill color for layer:', layer.id, e);
                        }
                      }
                    });
                  }
                } catch (e) {
                  console.debug('Error applying fill colors:', e);
                }
              };

              // Apply immediately and also on style load to catch any delayed layers
              applyFillColors();
              map.on('styledata', applyFillColors);

              // Also try applying after delays to catch any layers that load later
              setTimeout(applyFillColors, 500);
              setTimeout(applyFillColors, 1000);
              setTimeout(applyFillColors, 2000);

              // Prevent tiles from being culled during animations
              // This keeps labels visible during flyTo/easeTo
              try {
                const mapAny = map as any;

                // Increase tile buffer to load more tiles around the viewport
                if (mapAny._requestManager) {
                  mapAny._requestManager.setTileBuffer && mapAny._requestManager.setTileBuffer(256);
                }

                // Keep source tiles loaded even when not visible
                // This prevents labels from disappearing during zoom transitions
                const style = map.getStyle();
                if (style && style.sources) {
                  Object.keys(style.sources).forEach(sourceId => {
                    try {
                      const source = map.getSource(sourceId) as any;
                      if (source && source.tiles) {
                        // Set a very high tile cache size for this source
                        if (typeof source.setMaxTileCacheSize === 'function') {
                          source.setMaxTileCacheSize(512);
                        }
                      }
                    } catch (e) { }
                  });
                }

                // Disable tile unloading during camera movements
                map.on('movestart', () => {
                  try {
                    if (mapAny._frameId) {
                      // Keep rendering during movement
                      mapAny._render && mapAny._render();
                    }
                  } catch (e) { }
                });

              } catch (e) {
                console.debug('Could not configure tile caching:', e);
              }

              // Make all label layers use billboard effect (face camera)
              // Differentiate countries, states, and cities by size/thickness
              // Apply on style load and reapply on styledata to handle zoom resets
              const applyLabelStyles = () => {
                try {
                  const style = map.getStyle();
                  if (style && style.layers) {
                    // Log all label layers to understand structure (only on first run)
                    if (!stylesAppliedRef.current) {
                      const labelLayers = style.layers.filter((l: any) => l.type === 'symbol' && l.layout && l.layout['text-field']);
                      console.debug('Found label layers:', labelLayers.map((l: any) => ({
                        id: l.id,
                        'source-layer': l['source-layer'],
                        'text-field': l.layout?.['text-field']
                      })));
                    }

                    style.layers.forEach((layer: any) => {
                      // Apply billboard effect to text labels
                      if (layer.type === 'symbol' && layer.layout && layer.layout['text-field']) {
                        try {
                          // Set billboard alignment so text faces camera
                          map.setLayoutProperty(layer.id, 'text-rotation-alignment', 'viewport');
                          map.setLayoutProperty(layer.id, 'text-pitch-alignment', 'viewport');

                          // Differentiate countries, states, and cities by size/thickness
                          // Based on actual CartoDB Dark Matter GL style layer naming (uses underscores):
                          // - Countries: place_country_1, place_country_2, place_continent
                          // - States: place_state
                          // - Cities: place_city_*, place_city_dot_*
                          // - Capitals: place_capital_*
                          // - Towns: place_town, place_villages, place_suburbs, place_hamlet
                          const layerId = layer.id.toLowerCase();

                          // Determine label type - check in order: country, state, city
                          // Countries: place_country_* (exact match with underscores)
                          const isCountryLabel =
                            layerId.startsWith('place_country') ||
                            layerId === 'place_continent';

                          // States/Provinces: place_state (exact match, NOT capitals or cities)
                          const isStateLabel = !isCountryLabel && (
                            layerId === 'place_state' ||
                            layerId.startsWith('place_state_')
                          );

                          // Cities/Capitals/Towns: place_city_*, place_capital_*, place_town, etc.
                          const isCityLabel = !isCountryLabel && !isStateLabel && (
                            layerId.startsWith('place_city') ||
                            layerId.startsWith('place_capital') ||
                            layerId === 'place_town' ||
                            layerId.startsWith('place_town_') ||
                            layerId.startsWith('place_villages') ||
                            layerId.startsWith('place_suburbs') ||
                            layerId.startsWith('place_hamlet')
                          );

                          // Debug logging
                          if (isCountryLabel || isStateLabel || isCityLabel) {
                            console.debug(`Label classified: ${layer.id} -> ${isCountryLabel ? 'COUNTRY' : isStateLabel ? 'STATE' : 'CITY'}`);
                          }

                          // Style labels based on type with different sizes and thickness
                          // Labels gradually appear as you zoom in, disappear as you zoom out
                          // Lower opacity at low zoom = fewer labels shown (MapLibre collision detection)
                          if (isCountryLabel) {
                            // Country labels - largest and boldest
                            // Start showing at zoom 0, gradually increase to max at zoom 6
                            map.setLayoutProperty(layer.id, 'text-size', [
                              'interpolate',
                              ['linear'],
                              ['zoom'],
                              0, 8,       // Small size at zoom 0 (some labels visible)
                              1, 9,       // Slightly larger at zoom 1
                              2.2, 11,    // Default zoom (~2.2) - medium size
                              4, 13,      // Medium size at zoom 4
                              6, 14,      // Max size at zoom 6
                              8, 14       // Maintain max size at higher zoom
                            ]);
                            // Country labels use uppercase
                            map.setLayoutProperty(layer.id, 'text-transform', 'uppercase');
                            // Country labels: opacity controls how many show (fewer at low zoom, more at high zoom)
                            map.setPaintProperty(layer.id, 'text-opacity', [
                              'interpolate',
                              ['linear'],
                              ['zoom'],
                              0, 0.3,     // Low opacity at zoom 0 (only major countries)
                              1, 0.5,     // More visible at zoom 1
                              2.2, 0.7,   // Default zoom (~2.2) - good visibility
                              3, 0.85,    // Mostly visible at zoom 3
                              4, 0.9,     // Full opacity at zoom 4
                              6, 0.9,     // Maintain at higher zoom
                              8, 0.9      // Keep max at very high zoom
                            ]);
                            map.setPaintProperty(layer.id, 'text-halo-width', 1.5); // Thicker outline for countries
                            map.setPaintProperty(layer.id, 'text-halo-color', 'rgba(0, 0, 0, 0.6)');
                          } else if (isStateLabel) {
                            // State labels - medium size
                            // Start showing at zoom 1, gradually increase to max at zoom 7
                            map.setLayoutProperty(layer.id, 'text-size', [
                              'interpolate',
                              ['linear'],
                              ['zoom'],
                              1, 6,       // Small size at zoom 1
                              2.2, 8,     // Default zoom (~2.2) - small-medium
                              3.5, 9,     // Medium size at zoom 3.5
                              5, 11,      // Larger at zoom 5
                              7, 12,      // Max size at zoom 7
                              8, 12       // Maintain max size at higher zoom
                            ]);
                            // State labels use normal case (not uppercase) - explicitly set
                            try {
                              map.setLayoutProperty(layer.id, 'text-transform', 'none');
                            } catch (e) {
                              // Fallback: try to remove uppercase if it exists
                              try {
                                const currentTransform = map.getLayoutProperty(layer.id, 'text-transform');
                                if (currentTransform === 'uppercase') {
                                  map.setLayoutProperty(layer.id, 'text-transform', 'none');
                                }
                              } catch (e2) {
                                // Layer might not support text-transform
                              }
                            }
                            // State labels: gradually increase visibility as zoom increases
                            map.setPaintProperty(layer.id, 'text-opacity', [
                              'interpolate',
                              ['linear'],
                              ['zoom'],
                              1, 0.2,     // Very low opacity at zoom 1 (few states)
                              2.2, 0.5,   // Default zoom (~2.2) - some states visible
                              3, 0.7,     // More visible at zoom 3
                              4, 0.85,    // Mostly visible at zoom 4
                              5, 0.9,     // Full opacity at zoom 5
                              7, 0.9,     // Maintain at higher zoom
                              8, 0.9      // Keep max at very high zoom
                            ]);
                            map.setPaintProperty(layer.id, 'text-halo-width', 1); // Medium outline
                            map.setPaintProperty(layer.id, 'text-halo-color', 'rgba(0, 0, 0, 0.5)');
                          } else if (isCityLabel) {
                            // City labels - smallest and thinnest
                            // Start showing at zoom 2, gradually increase to max at zoom 8
                            map.setLayoutProperty(layer.id, 'text-size', [
                              'interpolate',
                              ['linear'],
                              ['zoom'],
                              2, 6,       // Small size at zoom 2
                              3, 7,       // Slightly larger at zoom 3
                              4, 9,       // Medium size at zoom 4
                              5.5, 10,    // Larger at zoom 5.5
                              7, 12,      // Larger at zoom 7
                              8, 12,      // Max size at zoom 8
                              10, 12      // Maintain max size at higher zoom
                            ]);
                            // City labels use normal case (not uppercase)
                            try {
                              map.setLayoutProperty(layer.id, 'text-transform', 'none');
                            } catch (e) {
                              // Some layers might not support this property
                            }
                            // City labels: gradually increase visibility as zoom increases
                            map.setPaintProperty(layer.id, 'text-opacity', [
                              'interpolate',
                              ['linear'],
                              ['zoom'],
                              2, 0.1,     // Very low opacity at zoom 2 (only major cities)
                              3, 0.3,     // Some cities at zoom 3
                              4, 0.6,     // More cities at zoom 4
                              5, 0.8,     // Many cities at zoom 5
                              6, 0.9,     // Full opacity at zoom 6
                              8, 0.9,     // Maintain at higher zoom
                              10, 0.9     // Keep max at very high zoom
                            ]);
                            map.setPaintProperty(layer.id, 'text-halo-width', 0.5); // Thinnest outline for cities
                            map.setPaintProperty(layer.id, 'text-halo-color', 'rgba(0, 0, 0, 0.4)');
                          } else {
                            // Other place labels - default styling
                            // Start showing at zoom 1.5, gradually increase to max at zoom 7
                            map.setLayoutProperty(layer.id, 'text-size', [
                              'interpolate',
                              ['linear'],
                              ['zoom'],
                              1.5, 7,     // Small size at zoom 1.5
                              2.2, 9,     // Default zoom (~2.2) - small-medium
                              3.5, 11,    // Medium size at zoom 3.5
                              5, 13,      // Larger at zoom 5
                              7, 14,      // Max size at zoom 7
                              8, 14       // Maintain max size at higher zoom
                            ]);
                            // Other labels use normal case (not uppercase)
                            try {
                              map.setLayoutProperty(layer.id, 'text-transform', 'none');
                            } catch (e) {
                              // Some layers might not support this property
                            }
                            map.setPaintProperty(layer.id, 'text-opacity', [
                              'interpolate',
                              ['linear'],
                              ['zoom'],
                              1.5, 0.3,   // Low opacity at zoom 1.5
                              2.2, 0.5,   // Default zoom (~2.2) - some labels
                              3, 0.7,     // More visible at zoom 3
                              4, 0.85,    // Mostly visible at zoom 4
                              5, 0.9,     // Full opacity at zoom 5
                              7, 0.9,     // Maintain at higher zoom
                              8, 0.9      // Keep max at very high zoom
                            ]);
                            map.setPaintProperty(layer.id, 'text-halo-width', 1);
                            map.setPaintProperty(layer.id, 'text-halo-color', 'rgba(0, 0, 0, 0.5)');
                          }

                          // Common styling for all labels
                          map.setPaintProperty(layer.id, 'text-color', '#9ca3af');
                          map.setPaintProperty(layer.id, 'text-halo-blur', 0.5);

                          // Add smooth transition duration for opacity and size changes
                          try {
                            map.setPaintProperty(layer.id, 'text-opacity-transition', {
                              duration: 800,
                              delay: 0
                            });
                            map.setLayoutProperty(layer.id, 'text-size-transition', {
                              duration: 800,
                              delay: 0
                            });
                          } catch (e) {
                            // Some layers might not support transition properties
                          }
                        } catch (e) {
                          // Some layers might not support these properties
                        }
                      }
                    });

                    stylesAppliedRef.current = true;
                  }
                } catch (e) {
                  console.debug('Could not access map style:', e);
                }
              };

              // Apply label styles immediately and on style reload
              applyLabelStyles();
              map.on('styledata', applyLabelStyles);

              // Make oceans/water match sidebar background color
              // Apply this regardless of stylesAppliedRef to ensure water color is correct
              try {
                const style = map.getStyle();
                if (style && style.layers) {
                  // Log all layers to find water layers
                  const waterLayers = style.layers.filter((l: any) =>
                    l.type === 'fill' && (
                      l.id.toLowerCase().includes('water') ||
                      l.id.toLowerCase().includes('ocean') ||
                      l.id.toLowerCase().includes('sea') ||
                      l.id.toLowerCase().includes('marine')
                    )
                  );
                  console.debug('Found water layers:', waterLayers.map((l: any) => l.id));

                  style.layers.forEach((layer: any) => {
                    // Make oceans/water match sidebar background color (#0f0f0f)
                    if (layer.type === 'fill' && (
                      layer.id.toLowerCase().includes('water') ||
                      layer.id.toLowerCase().includes('ocean') ||
                      layer.id.toLowerCase().includes('sea') ||
                      layer.id.toLowerCase().includes('marine')
                    )) {
                      try {
                        console.debug('Setting water color for layer:', layer.id);
                        map.setPaintProperty(layer.id, 'fill-color', '#0f0f0f'); // Match sidebar background color
                        map.setPaintProperty(layer.id, 'fill-opacity', 1.0); // Fully opaque
                      } catch (e) {
                        console.debug('Could not set water color for layer:', layer.id, e);
                      }
                    }

                    // Make lines fully opaque (boundaries, coastlines, etc.)
                    if (layer.type === 'line' && (
                      layer.id.includes('boundary') ||
                      layer.id.includes('admin') ||
                      layer.id.includes('border') ||
                      layer.id.includes('coastline') ||
                      layer.id.includes('waterway') ||
                      layer.id.includes('road')
                    )) {
                      try {
                        // Determine if this is a country boundary/border
                        const isCountryBoundary = layer.id.includes('boundary_country') ||
                          layer.id.includes('admin') ||
                          layer.id.includes('border');

                        // Country boundaries: use header border color (#F0A741 with 20% opacity = rgba(240, 167, 65, 0.2))
                        if (isCountryBoundary) {
                          map.setPaintProperty(layer.id, 'line-color', '#F0A741');
                          map.setPaintProperty(layer.id, 'line-opacity', 0.2);
                        } else {
                          // Other lines: darker gray
                          map.setPaintProperty(layer.id, 'line-color', '#1a1a1a');
                          map.setPaintProperty(layer.id, 'line-opacity', 1.0);
                        }
                        map.setPaintProperty(layer.id, 'line-width',
                          layer.paint?.['line-width'] ? ['*', ['get', 'line-width'], 0.85] : 1
                        );
                      } catch (e) {
                        // Some layers might not support these properties
                      }
                    }

                    // Make land fill layers black
                    if (layer.type === 'fill' && !(
                      layer.id.toLowerCase().includes('water') ||
                      layer.id.toLowerCase().includes('ocean') ||
                      layer.id.toLowerCase().includes('sea') ||
                      layer.id.toLowerCase().includes('marine')
                    )) {
                      try {
                        // Set land to black
                        map.setPaintProperty(layer.id, 'fill-color', '#000000');
                        map.setPaintProperty(layer.id, 'fill-opacity', 1.0); // Fully opaque
                      } catch (e) {
                        // Some layers might not support these properties
                      }
                    }

                    // Make all raster layers fully opaque
                    if (layer.type === 'raster') {
                      try {
                        map.setPaintProperty(layer.id, 'raster-opacity', 1.0); // Fully opaque
                      } catch (e) {
                        // Some layers might not support these properties
                      }
                    }
                  });
                }
              } catch (e) {
                console.debug('Could not apply water/line colors:', e);
              }

              // Configure tile caching more aggressively
              try {
                // Increase cache size if possible
                const mapAny = map as any;
                if (mapAny._tileCache) {
                  mapAny._tileCache.setMaxSize(200);
                }
              } catch (e) {
                // Ignore cache configuration errors
              }

              // Enable smooth momentum scrolling and interactions
              try {
                const mapAny = map as any;
                // Configure drag pan with momentum/inertia
                if (map.dragPan) {
                  map.dragPan.enable();
                  // Set inertia/momentum for smooth deceleration after drag
                  if (mapAny.dragPan?._inertiaOptions) {
                    mapAny.dragPan._inertiaOptions = {
                      exponential: 0.95, // Exponential decay factor
                    };
                  }
                }

                // Configure smooth zoom with easing
                if (map.scrollZoom) {
                  map.scrollZoom.setZoomRate(1 / 100); // Slower, smoother zoom
                  map.scrollZoom.setWheelZoomRate(1 / 450); // Even smoother wheel zoom
                  // Note: setAround doesn't exist on ScrollZoomHandler, removed
                }

                // Enable smooth rotation with momentum
                if (map.dragRotate) {
                  map.dragRotate.enable();
                }

                // Configure touch interactions for smooth mobile experience
                if (map.touchZoomRotate) {
                  map.touchZoomRotate.enable();
                }

                // Set general map options for smooth interactions
                if (mapAny._renderTaskQueue) {
                  // Ensure smooth rendering
                  mapAny._renderTaskQueue._abort = false;
                }
              } catch (e) {
                // Ignore configuration errors
              }

              // Note: Click handler is set up in a separate useEffect after layer is created
            }
          }}
          interactive={true}
          interactiveLayerIds={['nodes-layer', 'scan-connections-layer']}
          doubleClickZoom={true}
          dragRotate={true}
          touchZoomRotate={true}
          keyboard={true}
          scrollZoom={true}
          dragPan={true}
        >
          {/* Outer glow layer for nodes */}
          <Source
            id="nodes-glow-source"
            type="geojson"
            data={{
              type: 'FeatureCollection',
              features: nodeFeatures,
            }}
          >
            <Layer
              id="nodes-glow-layer"
              type="circle"
              paint={{
                'circle-radius': [
                  'case',
                  ['==', ['get', 'id'], currentNodeIndex >= 0 ? String(nodesWithLocation[currentNodeIndex]?.id ?? '') : ''], 18,
                  12
                ],
                'circle-color': [
                  'case',
                  ['==', ['get', 'status'], 'online'], '#3F8277',
                  ['==', ['get', 'status'], 'syncing'], '#F0A741',
                  '#FF4444'
                ],
                'circle-opacity': 0.15,
                'circle-blur': 1,
              }}
            />
          </Source>

          {/* Main nodes layer - crisp circles */}
          <Source
            id="nodes-source"
            type="geojson"
            data={{
              type: 'FeatureCollection',
              features: nodeFeatures,
            }}
          >
            <Layer
              id="nodes-layer"
              type="circle"
              paint={{
                'circle-radius': [
                  'interpolate',
                  ['linear'],
                  ['zoom'],
                  1, ['case',
                    ['==', ['get', 'id'], currentNodeIndex >= 0 ? String(nodesWithLocation[currentNodeIndex]?.id ?? '') : ''], 6,
                    4
                  ],
                  4, ['case',
                    ['==', ['get', 'id'], currentNodeIndex >= 0 ? String(nodesWithLocation[currentNodeIndex]?.id ?? '') : ''], 10,
                    7
                  ],
                  8, ['case',
                    ['==', ['get', 'id'], currentNodeIndex >= 0 ? String(nodesWithLocation[currentNodeIndex]?.id ?? '') : ''], 14,
                    10
                  ]
                ],
                'circle-color': [
                  'case',
                  ['==', ['get', 'status'], 'online'], '#3F8277',
                  ['==', ['get', 'status'], 'syncing'], '#FBBF24',
                  '#EF4444'
                ],
                'circle-stroke-width': [
                  'case',
                  ['==', ['get', 'id'], currentNodeIndex >= 0 ? String(nodesWithLocation[currentNodeIndex]?.id ?? '') : ''], 3,
                  1.5
                ],
                'circle-stroke-color': [
                  'case',
                  ['==', ['get', 'id'], currentNodeIndex >= 0 ? String(nodesWithLocation[currentNodeIndex]?.id ?? '') : ''], '#ffffff',
                  '#000000',
                ],
                'circle-opacity': 1.0,
              }}
            />
          </Source>

          {/* Scan connections - solid purple lines from scan location to top 20 nodes - render BEFORE nodes so lines are behind */}
          {scanConnections.length > 0 && (
            <Source
              id="scan-connections-source"
              type="geojson"
              data={{
                type: 'FeatureCollection',
                features: scanConnections,
              }}
            >
              <Layer
                id="scan-connections-layer"
                type="line"
                layout={{
                  'line-cap': 'round',
                  'line-join': 'round',
                }}
                paint={{
                  'line-color': [
                    'case',
                    ['==', ['get', 'connectorId'], activeScanConnector || ''],
                    '#FFFFFF', // White when active/selected
                    'rgba(240, 167, 65, 0.7)', // Gold color for scan connectors
                  ],
                  'line-width': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    1, [
                      'case',
                      ['==', ['get', 'connectorId'], activeScanConnector || ''],
                      3, // Active connector width
                      0.8, // Inactive connector width at zoom 1
                    ],
                    4, [
                      'case',
                      ['==', ['get', 'connectorId'], activeScanConnector || ''],
                      3, // Active connector width
                      1, // Inactive connector width at zoom 4
                    ],
                    8, [
                      'case',
                      ['==', ['get', 'connectorId'], activeScanConnector || ''],
                      3, // Active connector width
                      1.2, // Inactive connector width at zoom 8
                    ],
                    12, [
                      'case',
                      ['==', ['get', 'connectorId'], activeScanConnector || ''],
                      3, // Active connector width
                      1.5, // Inactive connector width at zoom 12
                    ],
                  ],
                  'line-opacity': [
                    'case',
                    ['==', ['get', 'connectorId'], activeScanConnector || ''],
                    1.0,
                    0.8,
                  ],
                  'line-dasharray': [3, 3], // Dotted lines
                }}
              />
            </Source>
          )}

          {/* Dotted circles around nodes connected to scan location */}
          {scanTopNodes && scanTopNodes.length > 0 && (() => {
            // Create circular line features for dotted circles around nodes
            const createCircle = (centerLon: number, centerLat: number, radiusKm: number, points: number = 64) => {
              const coordinates: [number, number][] = [];
              for (let i = 0; i <= points; i++) {
                const angle = (i / points) * 2 * Math.PI;
                // Convert km to degrees (approximate)
                const latOffset = (radiusKm / 111.32) * Math.cos(angle);
                const lonOffset = (radiusKm / (111.32 * Math.cos(centerLat * Math.PI / 180))) * Math.sin(angle);
                coordinates.push([centerLon + lonOffset, centerLat + latOffset]);
              }
              return coordinates;
            };

            const circleFeatures = scanTopNodes
              .filter(node => node.locationData?.lat && node.locationData?.lon)
              .map(node => ({
                type: 'Feature' as const,
                geometry: {
                  type: 'LineString' as const,
                  coordinates: createCircle(
                    node.locationData!.lon,
                    node.locationData!.lat,
                    0.05 // ~50km radius, adjust as needed
                  ),
                },
                properties: {
                  nodeId: node.id,
                },
              }));

            return (
              <Source
                id="scan-node-circles-source"
                type="geojson"
                data={{
                  type: 'FeatureCollection',
                  features: circleFeatures,
                }}
              >
                <Layer
                  id="scan-node-circles-layer"
                  type="line"
                  layout={{
                    'line-cap': 'round',
                    'line-join': 'round',
                  }}
                  paint={{
                    'line-color': 'rgba(240, 167, 65, 0.8)', // Gold color to match connection lines
                    'line-width': [
                      'interpolate',
                      ['linear'],
                      ['zoom'],
                      1, 1.5,
                      4, 2,
                      8, 2.5,
                      12, 3,
                    ],
                    'line-opacity': 0.8,
                    'line-dasharray': [4, 4], // Dotted circle
                  }}
                />
              </Source>
            );
          })()}

          {/* Cluster connection lines - thin threads connecting nodes in same cluster */}
          {clusterConnections.length > 0 && (
            <Source
              id="cluster-connections-source"
              type="geojson"
              data={{
                type: 'FeatureCollection',
                features: clusterConnections,
              }}
            >
              <Layer
                id="cluster-connections-layer"
                type="line"
                paint={{
                  'line-color': 'rgba(255, 255, 255, 0.4)',
                  'line-width': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    8, 0.5,
                    12, 1,
                    15, 1.5,
                  ],
                  'line-opacity': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    8, 0.3,
                    10, 0.5,
                    12, 0.6,
                  ],
                }}
              />
            </Source>
          )}

          {/* Scan location marker - pin icon */}
          {scanLocation && (
            <Marker
              longitude={scanLocation.lon}
              latitude={scanLocation.lat}
              anchor="bottom"
            >
              <div className="relative">
                {/* Pulsing ring effect */}
                <div
                  className="absolute inset-0 w-8 h-8 rounded-full animate-ping"
                  style={{
                    backgroundColor: 'rgba(240, 167, 65, 0.3)',
                    animationDuration: '2s',
                  }}
                />
                <MapPin
                  className="w-8 h-8 drop-shadow-lg"
                  fill="#F0A741"
                  stroke="#000"
                  strokeWidth={1}
                  style={{
                    filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.5))',
                    color: '#F0A741',
                  }}
                />
              </div>
            </Marker>
          )}
        </MapGL>

        {/* Node Details Popup - 60 FPS smooth with direct DOM manipulation */}
        {selectedNodeId && isLoaded && popupPosition.nodePos && popupPosition.popupPos && (() => {
          const nodeIndex = nodesWithLocation.findIndex(n => n.id === selectedNodeId);
          const selectedNode = nodeIndex >= 0 ? nodesWithLocation[nodeIndex] : null;
          if (!selectedNode || !selectedNode.locationData) {
            return null;
          }

          const status = selectedNode.status || 'offline';
          const statusColor = statusColors[status as keyof typeof statusColors] || statusColors.offline;

          const { nodePos } = popupPosition;
          const { lineEnd } = popupPosition.popupPos;
          const popupWidth = 336; // 280 * 1.2
          const popupHeight = 192; // 160 * 1.2

          // Always use current animated position from refs (animation loop is source of truth)
          // React state is only used for initial render, refs control everything else
          const currentAnimatedPos = currentPopupPosRef.current || popupPosition.popupPos;
          const popupX = currentAnimatedPos?.x ?? popupPosition.popupPos.x;
          const popupY = currentAnimatedPos?.y ?? popupPosition.popupPos.y;

          // Calculate initial connection line path (will be updated by animation loop)
          const lineEndX = popupX + lineEnd.x;
          const lineEndY = popupY + lineEnd.y;
          const midX = (nodePos.x + lineEndX) / 2;
          const midY = (nodePos.y + lineEndY) / 2 - 20;
          const pathD = `M ${nodePos.x} ${nodePos.y} Q ${midX} ${midY} ${lineEndX} ${lineEndY}`;

          return (
            <div
              key={`node-popup-${selectedNodeId}`}
              className="fixed inset-0 pointer-events-none"
              style={{ zIndex: 20 }}
            >
              {/* SVG for connector line and border - behind popup card */}
              <svg
                className="absolute inset-0 w-full h-full"
                style={{
                  pointerEvents: 'none',
                  zIndex: 10, // Behind popup card and modal
                }}
              >
                {/* Connector line - updated via ref for 60 FPS */}
                <path
                  ref={popupPathRef}
                  d={pathD}
                  fill="none"
                  stroke={statusColor}
                  strokeWidth="2"
                  strokeDasharray="8,4"
                  strokeLinecap="round"
                  opacity="0.8"
                  style={{
                    animation: 'dash 2s linear infinite',
                  }}
                />

                {/* Border rect - updated via ref for 60 FPS */}
                <rect
                  ref={popupRectRef}
                  x={popupX}
                  y={popupY}
                  width={popupWidth}
                  height={popupHeight}
                  rx="18"
                  ry="18"
                  fill="none"
                  stroke={statusColor}
                  strokeWidth="2"
                  strokeDasharray="8,4"
                  strokeLinecap="round"
                  opacity="0.8"
                  style={{
                    animation: 'dash 2s linear infinite',
                  }}
                />
              </svg>

              {/* Popup card - sits exactly inside the SVG stroke border, in front */}
              <div
                ref={popupCardRef}
                className="shadow-2xl backdrop-blur-sm cursor-pointer hover:bg-opacity-100 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  if (onPopupClick && selectedNode) {
                    onPopupClick(selectedNode);
                  }
                }}
                style={{
                  position: 'fixed',
                  left: `${popupX + 1}px`,
                  top: `${popupY + 1}px`,
                  width: `${popupWidth - 2}px`,
                  height: `${popupHeight - 2}px`,
                  backgroundColor: 'rgba(20, 24, 32, 0.95)',
                  borderRadius: '18px', // 15 * 1.2
                  zIndex: 20, // Above map but below modal (modal is z-50)
                  pointerEvents: 'auto',
                  animation: 'bubbleIn 0.15s cubic-bezier(0.16, 1, 0.3, 1) forwards',
                  boxShadow: `0 8px 32px rgba(0, 0, 0, 0.5)`,
                  willChange: 'transform, left, top',
                  overflow: 'hidden',
                  backfaceVisibility: 'hidden',
                }}
              >
                <div className="p-4 h-full flex flex-col justify-between">
                  {/* Public ID */}
                  <div>
                    <div className="text-[11px] text-muted-foreground/60 uppercase tracking-wider mb-1">Public ID</div>
                    <p className="text-[13px] font-mono text-foreground/90 leading-snug break-all">
                      {selectedNode.pubkey || selectedNode.publicKey || selectedNode.id}
                    </p>
                  </div>

                  {/* Location */}
                  <div>
                    <div className="text-[11px] text-muted-foreground/60 uppercase tracking-wider mb-1">Location</div>
                    <p className="text-[16px] text-foreground font-medium flex items-center gap-1.5">
                      {selectedNode.locationData?.countryCode && (
                        <span className="text-lg leading-none">{getFlagForCountry(selectedNode.locationData.country, selectedNode.locationData.countryCode)}</span>
                      )}
                      <span>
                        {selectedNode.locationData?.city
                          ? `${selectedNode.locationData.city}, ${selectedNode.locationData.country}`
                          : selectedNode.locationData?.country || 'Unknown'}
                      </span>
                    </p>
                  </div>

                  {/* IP Address */}
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[11px] text-muted-foreground/60 uppercase tracking-wider mb-1">IP Address</div>
                      <p className="text-[14px] font-mono text-foreground/80">
                        {selectedNode.address?.split(':')[0] || 'N/A'}
                      </p>
                    </div>
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: statusColor, boxShadow: `0 0 7px ${statusColor}` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })()}


        {/* Node Navigation Controls */}
        {isLoaded && navigableNodes.length > 0 && (
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex items-center gap-4 z-10 bg-card/90 backdrop-blur-sm border border-border rounded-lg p-2 shadow-lg">
            <button
              onClick={handlePreviousNode}
              className="p-2 hover:bg-muted rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Previous Node"
              disabled={navigableNodes.length <= 1}
            >
              <ChevronLeft className="w-5 h-5 text-foreground" />
            </button>
            <div className="px-4 py-1 text-body-small font-mono min-w-[80px] text-center">
              <span className="text-foreground">
                {currentNodeIndex >= 0 ? currentNodeIndex + 1 : 0}
              </span>
              <span className="text-muted-foreground"> / </span>
              <span className="text-muted-foreground">{navigableNodes.length}</span>
            </div>
            <button
              onClick={handleNextNode}
              className="p-2 hover:bg-muted rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Next Node"
              disabled={navigableNodes.length <= 1}
            >
              <ChevronRight className="w-5 h-5 text-foreground" />
            </button>
          </div>
        )}

        {/* Zoom Controls */}
        {isLoaded && (
          <div className="absolute bottom-4 left-4 flex flex-col gap-2 z-10">
            <button
              onClick={handleZoomIn}
              className="p-2 bg-card border border-border rounded hover:bg-muted transition-colors shadow-lg"
              title="Zoom In"
            >
              <ZoomIn className="w-5 h-5 text-foreground" />
            </button>
            <button
              onClick={handleZoomOut}
              className="p-2 bg-card border border-border rounded hover:bg-muted transition-colors shadow-lg"
              title="Zoom Out"
            >
              <ZoomOut className="w-5 h-5 text-foreground" />
            </button>
            <button
              onClick={handleResetView}
              className="p-2 bg-card border border-border rounded hover:bg-muted transition-colors shadow-lg"
              title="Reset View"
            >
              <RotateCcw className="w-5 h-5 text-foreground" />
            </button>
          </div>
        )}

        {/* Legend - Mobile button and desktop always visible */}
        {isLoaded && (
          <>
            {/* Mobile: Toggle button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setLegendOpen(!legendOpen);
              }}
              className="md:hidden absolute top-20 left-4 z-10 p-2 bg-card border border-border rounded shadow-lg hover:bg-muted transition-colors"
              title="Node Status Legend"
              aria-label="Toggle node status legend"
            >
              <Info className="w-5 h-5 text-foreground" />
            </button>

            {/* Legend content - visible on mobile when open, always visible on desktop */}
            <div
              ref={legendRef}
              onClick={(e) => e.stopPropagation()}
              className={`absolute top-20 left-4 md:top-4 md:left-4 bg-card border border-border rounded p-3 z-10 shadow-lg max-w-[200px] ${legendOpen || (typeof window !== 'undefined' && window.innerWidth >= 768) ? 'block' : 'hidden'
                }`}
            >
              <div className="text-body-small font-semibold mb-2">Node Status</div>
              <div className="flex flex-col gap-1.5">
                <div
                  className="flex items-center gap-2 group relative"
                  title="Seen in gossip network within last 5 minutes"
                >
                  <div
                    className="w-3 h-3 rounded-full border border-black"
                    style={{ backgroundColor: statusColors.online }}
                  />
                  <span className="text-body-small">Online</span>
                </div>
                <div
                  className="flex items-center gap-2 group relative"
                  title="Seen within last hour, still synchronizing with network"
                >
                  <div
                    className="w-3 h-3 rounded-full border border-black"
                    style={{ backgroundColor: statusColors.syncing }}
                  />
                  <span className="text-body-small">Syncing</span>
                </div>
                <div
                  className="flex items-center gap-2 group relative"
                  title="Not seen in gossip network for over an hour"
                >
                  <div
                    className="w-3 h-3 rounded-full border border-black"
                    style={{ backgroundColor: statusColors.offline }}
                  />
                  <span className="text-body-small">Offline</span>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-border text-body-small text-muted-foreground">
                {nodesWithLocation.length} nodes visible
              </div>
            </div>
          </>
        )}

        {!isLoaded && (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground z-10 bg-background/80">
            <div className="flex items-center gap-2">
              <Globe className="w-5 h-5 animate-spin" />
              <span>Loading 3D Globe...</span>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// Export component - removed memo to ensure map renders properly
export default MapLibreGlobe;

